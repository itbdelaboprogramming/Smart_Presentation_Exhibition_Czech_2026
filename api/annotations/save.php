<?php
declare(strict_types=1);

/**
 * POST { "annotations": [{ id, order, title, meshNames, anchor, labelOffset, camera }, ...] }
 * Syncs the full annotation list into js/recyclingPlantAnnotations.js, keeping each popup.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/Http.php';
require_once __DIR__ . '/../lib/AnnotationsFile.php';
require_once __DIR__ . '/../lib/AnnotationSync.php';

Http::requireLocalhost();
Http::requireMethod('POST');

try {
	$body = Http::readJsonBody();
	if (!$body instanceof stdClass || !is_array($body->annotations ?? null)) {
		throw new InvalidArgumentException('Expected { "annotations": [...] }.');
	}

	$file = new AnnotationsFile(ANNOTATIONS_JS_PATH);
	[$annotations, $result] = AnnotationSync::sync($file->load(), $body->annotations);
	$file->save($annotations);

	Http::sendJson(200, ['ok' => true] + $result);
} catch (InvalidArgumentException $e) {
	Http::sendJson(422, ['ok' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
	Http::sendJson(500, ['ok' => false, 'error' => $e->getMessage()]);
}
