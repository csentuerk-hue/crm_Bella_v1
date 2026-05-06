type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

export async function apiRequest<T>(
  input: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(input, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const fallback = `Anfrage fehlgeschlagen (${response.status}).`;
  const contentType = response.headers.get("content-type");
  const responseText = await response.text();

  const parseJsonBody = (): unknown | null => {
    if (!responseText.trim()) {
      return null;
    }
    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      return null;
    }
  };

  const jsonBody = parseJsonBody();

  if (!response.ok) {
    if (jsonBody && typeof jsonBody === "object" && "error" in jsonBody) {
      const errorMessage = (jsonBody as { error?: unknown }).error;
      if (typeof errorMessage === "string" && errorMessage.trim()) {
        throw new Error(errorMessage);
      }
    }

    if (responseText.trim() && !isJsonContentType(contentType)) {
      throw new Error(fallback);
    }

    throw new Error(fallback);
  }

  if (!responseText.trim()) {
    throw new Error("Serverantwort war leer.");
  }

  if (!jsonBody) {
    throw new Error("Serverantwort war kein gueltiges JSON.");
  }

  return jsonBody as T;
}
