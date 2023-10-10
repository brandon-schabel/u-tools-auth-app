import { createServerCookieFactory } from "@u-tools/core";
import { getAllCookies } from "@u-tools/core/modules/cookies/cookie-utils";
import { createServerFactory } from "@u-tools/core/modules/server";
import { jsonRes } from "@u-tools/core/modules/server/request-helpers";
import { Database } from "bun:sqlite";
import { getUser, loginUser } from "./auth";

export function setResponseheaders(response: Response, reqOrigin: string) {
  response.headers.append("Access-Control-Allow-Origin", reqOrigin);
  response.headers.append("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  response.headers.append("Access-Control-Allow-Headers", "Content-Type");
  response.headers.append("Access-Control-Allow-Credentials", "true");
  response.headers.append("Content-Type", "application/json");
}

// create a sqlite database if it doesn't exist

const db = new Database("data.db");

// create table if no exist
db.query(
  `
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY UNIQUE,
        username TEXT UNIQUE,
        password_hash TEXT UNIQUE,
        salt TEXT UNIQUE,
        security_token TEXT UNIQUE,
        security_token_id TEXT UNIQUE,
        security_token_expire_dt_epoch INTEGER
    )
`
).run();

const { start, route } = createServerFactory({});

const baseReq = route("/");
const loginReq = route("/login");

try {
  baseReq(async ({ request }) => {
    try {
      const response = new Response();
      const reqOrigin = request.headers.get("origin");

      if (request.method === "OPTIONS") {
        setResponseheaders(response, reqOrigin || "");

        return response;
      }

      const cookieSecret = createServerCookieFactory("secret", {
        request,
        response,
      });

      const clientId = request.headers.get("client-id") || "r#an3ld@m";

      const allCookies = getAllCookies(request);

      const secretToken = cookieSecret.getCookie(true);

      const user = getUser(db, clientId || "");

      return jsonRes(
        {
          message: user ? "Valid Match" : "No Valid Token",
          user,
        },
        {},
        response
      );
    } catch (e) {
      console.log(e);
    }

    return jsonRes({ message: "invalid" });
  });
} catch (e) {
  console.log({ e });
}

loginReq(async ({ request }) => {
  const reqOrigin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    const response = new Response(null);
    setResponseheaders(response, reqOrigin || "");

    return new Response(null, { headers: response.headers });
  }

  //  parse form data
  // get json from request body
  const data = await request.text();

  const parsedData = JSON.parse(data);

  const username = parsedData.username;
  const password = parsedData.password;

  const user = await loginUser(db, { username, password });

  if (!user) {
    return jsonRes({ message: "invalid username" });
  }

  const userId = user.id;

  // sets cookie on the response object
  const response = new Response();

  const cookieSecret = createServerCookieFactory("secret", {
    request,
    response,
  });

  response.headers.append("client-id", userId);
  // for client to be able to send cookies, we need to set the origin, it cannot be *
  setResponseheaders(response, reqOrigin || "");

  cookieSecret.setCookie(user.security_token);

  console.log(response.headers);

  return response;
});

start({ port: 3000, verbose: true });
