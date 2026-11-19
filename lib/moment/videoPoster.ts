/** Native: no canvas grab yet — callers fall back to empty poster. */
export async function captureVideoPosterUri(_videoUri: string, _seekSec?: number): Promise<string | null> {
  return null;
}
