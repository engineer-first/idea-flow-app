import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional when variables are already exported in the shell.
}

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const users = [
  {
    email: "owner@example.test",
    password: "password",
    name: "Dev Owner",
    role: "owner",
  },
  {
    email: "member@example.test",
    password: "password",
    name: "Dev Member",
    role: "member",
  },
  {
    email: "viewer@example.test",
    password: "password",
    name: "Dev Viewer",
    role: "viewer",
  },
];

if (!serviceRoleKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required.");
  console.error(
    "Run `npx supabase status -o env` after `npm run supabase:start`.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

for (const user of users) {
  const existingUser = await findUserByEmail(user.email);

  if (existingUser) {
    const { error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role,
        },
      },
    );

    if (error) {
      throw error;
    }

    console.log(`Updated ${user.email}`);
    continue;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      name: user.name,
      role: user.role,
    },
  });

  if (error) {
    throw error;
  }

  console.log(`Created ${user.email}`);
}
