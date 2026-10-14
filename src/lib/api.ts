const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "/api"
).replace(/\/+$/, "");

export async function login(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Login HTTP status:", response.status);
    console.error("Login response:", errorText);
    throw new Error(`Đăng nhập thất bại: HTTP ${response.status}`);
  }

  return response.json();
}