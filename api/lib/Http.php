<?php
declare(strict_types=1);

final class Http
{
	private const LOCAL_ADDRESSES = ['127.0.0.1', '::1'];

	/** File-writing endpoints are dev tools: only the machine running XAMPP may call them. */
	public static function requireLocalhost(): void
	{
		if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', self::LOCAL_ADDRESSES, true)) {
			self::sendJson(403, ['ok' => false, 'error' => 'Only available from localhost.']);
		}
	}

	public static function requireMethod(string $method): void
	{
		if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
			header("Allow: $method");
			self::sendJson(405, ['ok' => false, 'error' => "Use $method."]);
		}
	}

	/** Decodes the request body as JSON objects (stdClass) so `{}` and `[]` stay distinct. */
	public static function readJsonBody(): mixed
	{
		try {
			return json_decode(file_get_contents('php://input') ?: '', false, 512, JSON_THROW_ON_ERROR);
		} catch (JsonException $e) {
			throw new InvalidArgumentException('Request body is not valid JSON.');
		}
	}

	public static function sendJson(int $status, array $payload): never
	{
		http_response_code($status);
		header('Content-Type: application/json; charset=utf-8');
		echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		exit;
	}
}
