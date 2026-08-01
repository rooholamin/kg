/**
 * ffmpeg-based video assembly — concatenates the director agent's ordered
 * VideoSegment clips (each already carrying Higgsfield's native Seedance
 * audio, on-camera dialogue or off-screen voiceover alike), optionally
 * appends a fixed branded outro clip, mixes in a duration-matched ElevenLabs
 * music bed (covering segments+outro together), and optionally sends the
 * result to Captions.ai for styled captions. Always a MANUAL, standalone
 * trigger — never auto-run after a segment (re)generates, so a post can
 * accumulate several segment regenerations before paying for one assembly pass.
 *
 * Confirmed pitfall from testing: concatenating clips where some have an
 * audio stream and some don't causes real audio/video desync (ffmpeg's
 * concat demuxer doesn't insert silence correctly) — every clip is
 * defensively normalized to a real audio stream before concatenation, even
 * though every segment should already have native audio.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { composeMusic, calculateMusicCost } from './elevenlabs.service';
import { addCaptions, calculateCaptionsCost } from './captions-ai.service';
import { uploadBufferToSpaces } from './video-export.service';
import { logStart, logDone } from '@/lib/video-logger';

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

// width/height for the orientations exposed in Video Settings / campaign config
const ORIENTATION_RESOLUTIONS = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '3:4': { width: 1080, height: 1440 },
  '21:9': { width: 1920, height: 823 },
};

function getResolution(orientation) {
  return ORIENTATION_RESOLUTIONS[orientation] || ORIENTATION_RESOLUTIONS['9:16'];
}

async function run(cmd, args) {
  try {
    return await execFileAsync(cmd, args, { maxBuffer: 1024 * 1024 * 64 });
  } catch (err) {
    throw new Error(`${cmd} failed: ${err.stderr?.slice(-2000) || err.message}`);
  }
}

async function probeDuration(filePath) {
  const { stdout } = await run(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ]);
  const seconds = parseFloat(stdout.trim());
  return Number.isFinite(seconds) ? seconds : 0;
}

async function hasAudioStream(filePath) {
  const { stdout } = await run(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'a',
    '-show_entries', 'stream=index',
    '-of', 'csv=p=0',
    filePath,
  ]);
  return stdout.trim().length > 0;
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url} (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  return destPath;
}

/**
 * Scales/crops to the target orientation's resolution and guarantees a real
 * (never absent) AAC audio stream, re-encoding to a uniform codec/fps so the
 * subsequent concat-demuxer pass can safely stream-copy.
 */
async function normalizeClip(inputPath, outputPath, orientation) {
  const { width, height } = getResolution(orientation);
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30`;
  const clipHasAudio = await hasAudioStream(inputPath);

  if (clipHasAudio) {
    await run(FFMPEG, [
      '-y', '-i', inputPath,
      '-vf', scaleFilter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2',
      outputPath,
    ]);
  } else {
    await run(FFMPEG, [
      '-y', '-i', inputPath,
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-vf', scaleFilter,
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2',
      outputPath,
    ]);
  }
  return outputPath;
}

async function concatClips(clipPaths, outputPath, workDir) {
  const listPath = path.join(workDir, 'concat_list.txt');
  const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, listContent);
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath]);
  return outputPath;
}

async function mixMusicUnderNarration(videoPath, musicPath, volume, outputPath) {
  const filter =
    `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${volume}[music];` +
    `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[narr];` +
    `[narr][music]amix=inputs=2:duration=first:dropout_transition=3[aout]`;
  await run(FFMPEG, [
    '-y', '-i', videoPath, '-i', musicPath,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac',
    outputPath,
  ]);
  return outputPath;
}

/**
 * Shared tail end of the pipeline: (music) -> (captions) -> upload. Used by
 * both a full assembly pass and a music-only regeneration, since neither
 * needs to re-download/re-normalize/re-concatenate segments that haven't
 * changed — only the un-mixed, un-captioned base render does.
 */
async function finalizeVideo({ post, basePath, workDir, totalDurationMs, orientation, musicConfig, captionsConfig }) {
  let additionalCost = 0;
  let currentPath = basePath;
  let musicUrl = null;

  if (musicConfig?.enabled) {
    const musicLogId = await logStart(post.campaignId, 'assembly_music_generate', 'Generating background music (ElevenLabs)', null, post.id);
    const { buffer: musicBuffer } = await composeMusic({
      prompt: musicConfig.prompt,
      durationMs: totalDurationMs,
      modelId: musicConfig.modelId,
    });
    const musicPath = path.join(workDir, 'music.mp3');
    await fs.writeFile(musicPath, musicBuffer);
    await logDone(musicLogId, 'Music track generated');

    const mixLogId = await logStart(post.campaignId, 'assembly_music_mix', 'Mixing music under narration', null, post.id);
    const mixedPath = path.join(workDir, 'mixed.mp4');
    await mixMusicUnderNarration(currentPath, musicPath, musicConfig.volume ?? 0.3, mixedPath);
    currentPath = mixedPath;
    additionalCost += calculateMusicCost(totalDurationMs);
    await logDone(mixLogId, 'Music mixed under narration');

    musicUrl = await uploadBufferToSpaces(musicBuffer, `video/music/${post.id}-${Date.now()}.mp3`, 'audio/mpeg');
  }

  // Captions is the LAST, most failure-prone step (external API, strict
  // size/orientation limits) — a failure here should never lose the
  // concat+music work already done. Falls back to the uncaptioned video
  // rather than throwing, and always reports why captions weren't applied.
  let captionsApplied = false;
  let captionsSkipReason = null;
  if (!captionsConfig?.enabled) {
    captionsSkipReason = 'disabled';
  } else if (orientation !== '9:16') {
    captionsSkipReason = `Captions.ai requires 9:16, this video is ${orientation}`;
  } else if (!captionsConfig.templateId) {
    captionsSkipReason = 'no caption template configured';
  } else {
    const captionsLogId = await logStart(post.campaignId, 'assembly_captions', 'Generating captions (Captions.ai) — this can take a couple minutes', null, post.id);
    try {
      const currentBuffer = await fs.readFile(currentPath);
      if (currentBuffer.length > 50 * 1024 * 1024) {
        captionsSkipReason = `video is ${(currentBuffer.length / 1024 / 1024).toFixed(1)}MB, over Captions.ai's 50MB limit`;
        await logDone(captionsLogId, `Captions skipped: ${captionsSkipReason}`);
      } else {
        const { buffer: captionedBuffer } = await addCaptions({
          videoBuffer: currentBuffer,
          templateId: captionsConfig.templateId,
        });
        const captionedPath = path.join(workDir, 'captioned.mp4');
        await fs.writeFile(captionedPath, captionedBuffer);
        currentPath = captionedPath;
        captionsApplied = true;
        additionalCost += calculateCaptionsCost(totalDurationMs);
        await logDone(captionsLogId, 'Captions applied');
      }
    } catch (err) {
      captionsSkipReason = `Captions.ai failed: ${err.message}`;
      await logDone(captionsLogId, `Captions skipped: ${captionsSkipReason}`);
    }
  }

  const uploadLogId = await logStart(post.campaignId, 'assembly_upload_final', 'Uploading final video', null, post.id);
  const finalBuffer = await fs.readFile(currentPath);
  const videoUrl = await uploadBufferToSpaces(
    finalBuffer,
    `video/clips/${post.id}-${Date.now()}.mp4`,
    'video/mp4',
  );
  await logDone(uploadLogId, 'Final video uploaded');

  return {
    videoUrl,
    musicUrl,
    captionsApplied,
    captionsSkipReason: captionsApplied ? null : captionsSkipReason,
    additionalCost,
  };
}

/**
 * Full manual assembly pass for one post: concat -> (outro) -> (music) -> (captions) -> upload.
 * Also uploads and returns the pre-music, pre-captions concatenated render
 * (`narrationVideoUrl`) so a later music-only regeneration doesn't have to
 * re-download/re-normalize/re-concatenate every segment (or the outro) again.
 *
 * The outro (if configured) is appended BEFORE `totalDurationMs` is measured,
 * so the ElevenLabs music track is generated to cover segments+outro and
 * keeps playing under the outro instead of cutting off when it starts.
 *
 * @param {Object} params
 * @param {Object} params.post - VideoPost row (needs id, orientation/campaign orientation, musicVolume, captionsEnabled)
 * @param {Array}  params.segments - ordered VideoSegment rows (status completed, videoUrl set)
 * @param {string} params.orientation - resolved effective orientation ("9:16" etc.)
 * @param {Object} params.musicConfig - { enabled, volume, prompt, modelId }
 * @param {Object} params.captionsConfig - { enabled, templateId }
 * @param {Object} [params.outroConfig] - { enabled, videoUrl } — branded clip appended to the end
 * @returns {Promise<{ videoUrl, narrationVideoUrl, musicUrl, duration, captionsApplied, captionsSkipReason, additionalCost }>}
 */
export async function assembleVideo({ post, segments, orientation, musicConfig, captionsConfig, outroConfig }) {
  const completedSegments = segments
    .filter((s) => s.status === 'completed' && s.videoUrl)
    .sort((a, b) => a.order - b.order);

  if (!completedSegments.length) {
    throw new Error('No completed segments to assemble — generate/regenerate segments first.');
  }

  const workDir = path.join(os.tmpdir(), `video-assembly-${post.id}-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const stitchLogId = await logStart(post.campaignId, 'assembly_stitch', `Downloading and stitching ${completedSegments.length} segment${completedSegments.length !== 1 ? 's' : ''}`, null, post.id);
    const normalizedPaths = [];
    for (const [i, segment] of completedSegments.entries()) {
      const rawPath = path.join(workDir, `raw_${i}.mp4`);
      const normPath = path.join(workDir, `norm_${i}.mp4`);
      await downloadToFile(segment.videoUrl, rawPath);
      await normalizeClip(rawPath, normPath, orientation);
      normalizedPaths.push(normPath);
    }

    if (outroConfig?.enabled && outroConfig.videoUrl) {
      const rawOutroPath = path.join(workDir, 'raw_outro.mp4');
      const normOutroPath = path.join(workDir, 'norm_outro.mp4');
      await downloadToFile(outroConfig.videoUrl, rawOutroPath);
      await normalizeClip(rawOutroPath, normOutroPath, orientation);
      normalizedPaths.push(normOutroPath);
    }

    const concatPath = path.join(workDir, 'concatenated.mp4');
    await concatClips(normalizedPaths, concatPath, workDir);
    const totalDurationSeconds = await probeDuration(concatPath);
    const totalDurationMs = Math.round(totalDurationSeconds * 1000);
    await logDone(stitchLogId, `Stitched into a ${Math.round(totalDurationSeconds)}s clip`);

    const concatBuffer = await fs.readFile(concatPath);
    const narrationVideoUrl = await uploadBufferToSpaces(
      concatBuffer,
      `video/narration/${post.id}-${Date.now()}.mp4`,
      'video/mp4',
    );

    const result = await finalizeVideo({ post, basePath: concatPath, workDir, totalDurationMs, orientation, musicConfig, captionsConfig });

    return { ...result, narrationVideoUrl, duration: Math.round(totalDurationSeconds) };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Music-only regeneration — reuses the already-assembled, pre-music base
 * render (`post.narrationVideoUrl`) so it never has to re-download,
 * re-normalize, or re-concatenate segments. Still re-applies captions
 * afterward if enabled, since Captions.ai works on the final mixed render.
 *
 * @returns {Promise<{ videoUrl, musicUrl, duration, captionsApplied, captionsSkipReason, additionalCost }>}
 */
export async function regenerateMusicOnly({ post, orientation, musicConfig, captionsConfig }) {
  if (!post.narrationVideoUrl) {
    throw new Error('No base render to remix — run a full Re-assemble at least once first.');
  }

  const workDir = path.join(os.tmpdir(), `video-music-${post.id}-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const fetchLogId = await logStart(post.campaignId, 'assembly_fetch_base', 'Fetching existing base render', null, post.id);
    const basePath = path.join(workDir, 'base.mp4');
    await downloadToFile(post.narrationVideoUrl, basePath);
    const totalDurationSeconds = await probeDuration(basePath);
    const totalDurationMs = Math.round(totalDurationSeconds * 1000);
    await logDone(fetchLogId, 'Base render ready');

    const result = await finalizeVideo({ post, basePath, workDir, totalDurationMs, orientation, musicConfig, captionsConfig });

    return { ...result, duration: Math.round(totalDurationSeconds) };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
