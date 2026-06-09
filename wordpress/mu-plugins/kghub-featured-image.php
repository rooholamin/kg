<?php
/**
 * KGHub Featured Image
 *
 * Replicates exactly what FIFU does on an admin save:
 * inserts a virtual attachment record with post_author = FIFU_AUTHOR (77777)
 * and post_content_filtered = S3 URL. This makes FIFU's own get_attached_file
 * filter intercept the URL and return the S3 URL directly, without WP
 * prepending wp-content/uploads/.
 *
 * Endpoint: POST /wp-json/kghub/v1/set-featured-image
 * Header:   X-Kghub-Secret: <WP_KGHUB_SECRET from wp-config.php>
 * Body:     { "post_id": 123, "image_url": "https://...", "title": "..." }
 */

defined('ABSPATH') || exit;

add_action('rest_api_init', function () {
    register_rest_route('kghub/v1', '/set-featured-image', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'kghub_set_featured_image',
        'permission_callback' => '__return_true',
    ]);
});

function kghub_set_featured_image(WP_REST_Request $request) {
    $secret   = defined('KGHUB_WP_SECRET') ? KGHUB_WP_SECRET : getenv('KGHUB_WP_SECRET');
    $provided = $request->get_header('x_kghub_secret');

    if (!$secret || !hash_equals($secret, (string) $provided)) {
        return new WP_Error('unauthorized', 'Invalid or missing secret.', ['status' => 401]);
    }

    $post_id   = (int) $request->get_param('post_id');
    $image_url = esc_url_raw((string) $request->get_param('image_url'));
    $title     = sanitize_text_field((string) ($request->get_param('title') ?? ''));

    if (!$post_id || !$image_url) {
        return new WP_Error('bad_request', 'post_id and image_url are required.', ['status' => 400]);
    }

    if (!get_post($post_id)) {
        return new WP_Error('not_found', "Post {$post_id} not found.", ['status' => 404]);
    }

    global $wpdb;

    // FIFU_AUTHOR is what FIFU uses to mark its own attachment records.
    // FIFU's get_attached_file filter ONLY intercepts attachments with this author.
    $fifu_author = (int) (get_option('fifu_author') ?: 77777);

    // Check if a FIFU-style attachment already exists for this post + URL
    $existing_att_id = $wpdb->get_var($wpdb->prepare(
        "SELECT pm.post_id
         FROM {$wpdb->postmeta} pm
         INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
         WHERE pm.meta_key = '_wp_attached_file'
           AND pm.meta_value = %s
           AND p.post_parent = %d
           AND p.post_author = %d
         LIMIT 1",
        $image_url, $post_id, $fifu_author
    ));

    if ($existing_att_id) {
        // Already exists — just make sure _thumbnail_id points to it
        update_post_meta($post_id, '_thumbnail_id', (int) $existing_att_id);
        return rest_ensure_response([
            'ok'            => true,
            'attachment_id' => (int) $existing_att_id,
            'post_id'       => $post_id,
            'note'          => 'Already exists — _thumbnail_id updated.',
        ]);
    }

    // Detect mime type from URL extension (FIFU always uses image/jpeg as default)
    $ext      = strtolower(pathinfo(parse_url($image_url, PHP_URL_PATH), PATHINFO_EXTENSION));
    $mime_map = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
    $mime     = $mime_map[$ext] ?? 'image/jpeg';

    // Insert the attachment row exactly as FIFU does:
    // - post_author = fifu_author  (triggers FIFU's get_attached_file filter)
    // - guid        = ''           (FIFU leaves this blank)
    // - post_content_filtered = URL (FIFU stores the URL here)
    // - _wp_attached_file meta = URL (FIFU reads from here in its filter)
    $now = current_time('mysql');
    $now_gmt = current_time('mysql', 1);

    $inserted = $wpdb->insert($wpdb->posts, [
        'post_author'           => $fifu_author,
        'guid'                  => '',
        'post_title'            => $title,
        'post_excerpt'          => $title,
        'post_mime_type'        => $mime,
        'post_type'             => 'attachment',
        'post_status'           => 'inherit',
        'post_parent'           => $post_id,
        'post_date'             => $now,
        'post_date_gmt'         => $now_gmt,
        'post_modified'         => $now,
        'post_modified_gmt'     => $now_gmt,
        'post_content'          => '',
        'post_content_filtered' => $image_url,
        'to_ping'               => '',
        'pinged'                => '',
    ]);

    if (!$inserted) {
        return new WP_Error('insert_failed', 'Failed to insert attachment record.', ['status' => 500]);
    }

    $attach_id = $wpdb->insert_id;

    // Store the URL in _wp_attached_file (FIFU's filter reads this key)
    update_post_meta($attach_id, '_wp_attached_file', $image_url);
    // Alt text
    if ($title) {
        update_post_meta($attach_id, '_wp_attachment_image_alt', $title);
    }

    // Set as featured image on the post
    update_post_meta($post_id, '_thumbnail_id', $attach_id);

    // Remove any stale FIFU-author attachments for this post that are NOT this one
    $stale = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts}
         WHERE post_parent = %d AND post_author = %d AND ID != %d",
        $post_id, $fifu_author, $attach_id
    ));
    foreach ($stale as $stale_id) {
        $wpdb->delete($wpdb->postmeta, ['post_id' => (int) $stale_id]);
        $wpdb->delete($wpdb->posts, ['ID' => (int) $stale_id, 'post_author' => $fifu_author]);
    }

    return rest_ensure_response([
        'ok'            => true,
        'attachment_id' => $attach_id,
        'post_id'       => $post_id,
        'image_url'     => $image_url,
        'fifu_author'   => $fifu_author,
    ]);
}
