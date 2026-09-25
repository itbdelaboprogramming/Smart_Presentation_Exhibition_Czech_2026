<?php
declare(strict_types=1);

/**
 * Reads and writes the annotations array literal inside recyclingPlantAnnotations.js.
 * Everything around the array (DEFAULT_VIEW, the export) is preserved byte for byte.
 */
final class AnnotationsFile
{
	private const START_MARKER = 'const annotations =';
	private const END_MARKER = 'export default annotations;';
	private const JSON_FLAGS = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
		| JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR;

	public function __construct(private readonly string $path)
	{
	}

	/** @return list<stdClass> */
	public function load(): array
	{
		[, $body] = $this->split($this->read());
		try {
			$annotations = json_decode($body, false, 512, JSON_THROW_ON_ERROR);
		} catch (JsonException $e) {
			$hint = preg_match('#^\s*(//|/\*)#m', $body) ? ' Remove comments from the array (they would be lost on save).' : '';
			throw new RuntimeException('Annotations array in the JS file is not valid JSON: ' . $e->getMessage() . '.' . $hint);
		}
		if (!is_array($annotations)) {
			throw new RuntimeException('Annotations in the JS file must be an array.');
		}
		return $annotations;
	}

	/** @param list<stdClass> $annotations */
	public function save(array $annotations): void
	{
		$source = $this->read();
		[$head, , $tail] = $this->split($source);
		$eol = str_contains($source, "\r\n") ? "\r\n" : "\n";
		$this->writeAtomically($head . str_replace("\n", $eol, self::encode($annotations)) . $tail);
	}

	private function read(): string
	{
		$source = @file_get_contents($this->path);
		if ($source === false) {
			throw new RuntimeException('Cannot read annotations file.');
		}
		return $source;
	}

	/** @return array{string, string, string} [before array, array literal, after array] */
	private function split(string $source): array
	{
		$start = strpos($source, self::START_MARKER);
		$open = $start === false ? false : strpos($source, '[', $start);
		$end = strrpos($source, self::END_MARKER);
		$close = $end === false ? false : strrpos(substr($source, 0, $end), ']');
		if ($open === false || $close === false || $close < $open) {
			throw new RuntimeException('Cannot locate the annotations array in the JS file.');
		}
		return [
			substr($source, 0, $open),
			substr($source, $open, $close - $open + 1),
			substr($source, $close + 1),
		];
	}

	/** Matches JSON.stringify(data, null, 2): PHP pretty-prints with 4-space indents. */
	private static function encode(array $annotations): string
	{
		$json = json_encode($annotations, self::JSON_FLAGS);
		return preg_replace_callback('/^ +/m', fn ($m) => str_repeat(' ', intdiv(strlen($m[0]), 2)), $json);
	}

	/** Write to a temp file then rename, so a failed write never leaves a half-written JS file. */
	private function writeAtomically(string $contents): void
	{
		$tmp = $this->path . '.tmp';
		if (file_put_contents($tmp, $contents, LOCK_EX) === false || !rename($tmp, $this->path)) {
			@unlink($tmp);
			throw new RuntimeException('Cannot write annotations file.');
		}
	}
}
