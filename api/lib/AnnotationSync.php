<?php
declare(strict_types=1);

/** The fields owned by the tag tool. Popup content and any other field are kept as they are. */
final class AnnotationSync
{
	public const FIELDS = ['order', 'group', 'title', 'meshNames', 'anchor', 'labelOffset', 'camera'];

	/**
	 * Makes the annotation list match $incoming: known ids are updated in place, new ids are
	 * created with an empty popup, ids missing from $incoming are removed.
	 * Everything is validated before anything is applied.
	 *
	 * @param list<stdClass> $annotations
	 * @return array{0: list<stdClass>, 1: array{created: list<string>, updated: list<string>, removed: list<string>}}
	 */
	public static function sync(array $annotations, array $incoming): array
	{
		$seen = [];
		foreach ($incoming as $i => $item) {
			self::validate($item, $i);
			$id = (string) $item->id;
			if (isset($seen[$id])) {
				throw new InvalidArgumentException("annotations[$i]: duplicate id \"$id\".");
			}
			$seen[$id] = true;
		}

		$byId = [];
		foreach ($annotations as $annotation) {
			$byId[(string) $annotation->id] = $annotation;
		}

		$result = ['created' => [], 'updated' => [], 'removed' => []];
		$synced = [];
		foreach ($incoming as $item) {
			$id = (string) $item->id;
			$annotation = $byId[$id] ?? self::create($id);
			$result[isset($byId[$id]) ? 'updated' : 'created'][] = $id;
			foreach (self::FIELDS as $field) {
				$annotation->$field = $item->$field ?? null;
			}
			$synced[] = $annotation;
		}
		$result['removed'] = array_values(array_diff(array_keys($byId), array_keys($seen)));

		return [$synced, $result];
	}

	private static function create(string $id): stdClass
	{
		$annotation = new stdClass();
		$annotation->id = $id;
		foreach (self::FIELDS as $field) {
			$annotation->$field = null;
		}
		$annotation->popup = ['en' => ['blocks' => []], 'ja' => ['blocks' => []]];
		return $annotation;
	}

	private static function validate(mixed $item, int $index): void
	{
		$fail = static fn (string $msg) => throw new InvalidArgumentException("annotations[$index]: $msg");

		if (!$item instanceof stdClass || !(is_string($item->id ?? null) || is_int($item->id ?? null))) {
			$fail('must be an object with a string or number "id".');
		}
		if (!is_int($item->order ?? null)) {
			$fail('"order" must be an integer.');
		}
		if (($item->group ?? null) !== null && !is_string($item->group)) {
			$fail('"group" must be null or a string.');
		}
		if (!self::isTitle($item->title ?? null)) {
			$fail('"title" must be {en: string, ja?: string} with a non-empty "en".');
		}
		if (!(is_array($item->meshNames ?? null) && array_is_list($item->meshNames)
			&& count(array_filter($item->meshNames, 'is_string')) === count($item->meshNames))) {
			$fail('"meshNames" must be an array of strings.');
		}
		foreach (['anchor', 'labelOffset'] as $field) {
			if (($item->$field ?? null) !== null && !self::isVec3($item->$field)) {
				$fail("\"$field\" must be null or {x, y, z}.");
			}
		}
		if (($item->camera ?? null) !== null && !self::isCamera($item->camera)) {
			$fail('"camera" must be null or {position: {x, y, z}, target: {x, y, z}, duration}.');
		}
	}

	private static function isTitle(mixed $t): bool
	{
		return $t instanceof stdClass
			&& is_string($t->en ?? null) && trim($t->en) !== ''
			&& (!property_exists($t, 'ja') || is_string($t->ja));
	}

	private static function isVec3(mixed $v): bool
	{
		return $v instanceof stdClass
			&& self::isNumber($v->x ?? null) && self::isNumber($v->y ?? null) && self::isNumber($v->z ?? null);
	}

	private static function isCamera(mixed $c): bool
	{
		return $c instanceof stdClass
			&& self::isVec3($c->position ?? null) && self::isVec3($c->target ?? null)
			&& self::isNumber($c->duration ?? null);
	}

	private static function isNumber(mixed $n): bool
	{
		return is_int($n) || (is_float($n) && is_finite($n));
	}
}
