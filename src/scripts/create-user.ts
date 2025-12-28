
import dotenv from 'dotenv';
dotenv.config();

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
    console.error("CLERK_SECRET_KEY is missing");
    process.exit(1);
}

async function createUser() {
    const email = `admin_manual_${Math.floor(Math.random() * 10000)}@example.com`;
    const password = "SecureP@ssword123!";

    console.log(`Attempting to create user: ${email}`);

    try {
        const response = await fetch('https://api.clerk.com/v1/users', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_address: [email],
                password: password,
                skip_password_checks: true,
                skip_legal_checks: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Failed to create user:", data);
            return;
        }

        console.log("User created successfully!");
        console.log("Email:", email);
        console.log("Password:", password);
        console.log("User ID:", data.id);

    } catch (error) {
        console.error("Error creating user:", error);
    }
}

createUser();
