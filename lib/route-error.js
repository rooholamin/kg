import { NextResponse } from 'next/server';

/**
 * Converts thrown errors into appropriate NextResponse objects.
 * Use in API route catch blocks.
 */
export function routeError(e, fallbackMessage = 'Oops! Something went wrong. Please try again in a moment.') {
  if (e?.code === 'FORBIDDEN') {
    return NextResponse.json(
      { message: "You don't have permission to perform this action." },
      { status: 403 },
    );
  }
  if (e?.code === 'NOT_FOUND') {
    return NextResponse.json({ message: e.message }, { status: 404 });
  }
  // Precondition failures the user can act on ("nothing to continue", "not
  // trained yet") — worth showing verbatim instead of the generic fallback.
  if (e?.code === 'INVALID_REQUEST') {
    return NextResponse.json({ message: e.message }, { status: 422 });
  }
  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
}
