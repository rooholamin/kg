import { prisma } from '@/lib/prisma';

/**
 * A custom video's on-screen character comes from one of two places: the
 * standalone VideoCharacter roster, or an existing section's already-trained
 * character. Both custom-post creation routes (campaign-attached and
 * standalone) accept either, so this resolves + validates the choice once.
 *
 * Returns `{ error, status }` on failure, or `{ data }` with the VideoPost
 * fields to persist on success.
 */
export async function resolveCustomVideoCharacter({ characterId, sectionId }) {
  if (characterId && sectionId) {
    return { error: 'Provide either characterId or sectionId, not both', status: 400 };
  }

  if (sectionId) {
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return { error: 'Section not found', status: 404 };
    if (!section.videoCharacterId) {
      return {
        error: `${section.characterName || section.name} hasn't been trained yet — train the character from Video → Characters first.`,
        status: 422,
      };
    }
    return { data: { customSectionId: sectionId, customCharacterId: null } };
  }

  const character = await prisma.videoCharacter.findUnique({ where: { id: characterId } });
  if (!character) return { error: 'Character not found', status: 404 };
  if (!character.videoCharacterId) {
    return {
      error: `"${character.name}" hasn't been trained yet — train it from Video → Characters first.`,
      status: 422,
    };
  }
  return { data: { customCharacterId: characterId, customSectionId: null } };
}

/**
 * Optional per-post environment override. A blank description means "shoot in
 * the global KG Media Loft", so it's stored as null rather than an empty
 * string — resolveEnvironment() in the pipeline keys off the description.
 */
export function customEnvironmentFields({ environmentName, environmentDescription }) {
  const description = environmentDescription?.trim();
  if (!description) return { customEnvironmentName: null, customEnvironmentDescription: null };
  return {
    customEnvironmentName: environmentName?.trim() || null,
    customEnvironmentDescription: description,
  };
}
