export async function readAuthResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as {
      error?: string;
      message?: string;
      code?: string;
      redirect?: string;
      url?: string;
      success?: boolean;
    };
  } catch {
    throw new Error("The sign-in service did not respond correctly. Try again.");
  }
}
