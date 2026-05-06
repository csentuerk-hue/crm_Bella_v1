import { NextResponse } from "next/server";
import { z } from "zod";

export function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Ungültige Eingaben.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function serverError(message = "Interner Fehler.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

