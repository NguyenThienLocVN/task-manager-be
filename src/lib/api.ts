const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function login(
    username: string,
    password: string,
) {
    const response =
        await fetch(`${API_URL}/auth/login`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                },

                credentials: 'include',

                body: JSON.stringify({
                    username,
                    password,
                }),
            },
        );

    if (!response.ok) {
        const error = await response.json();

        throw new Error(
            error.message || 'Đăng nhập thất bại',
        );
    }

    return response.json();
}