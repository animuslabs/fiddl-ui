"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const functions_1 = require("@netlify/functions");
const generateMetadata = (dynamicId, index) => __awaiter(void 0, void 0, void 0, function* () {
    return {
        title: `Page for ${dynamicId} - Index ${index}`,
        description: `This is a description for ${dynamicId} at index ${index}.`,
        image: "https://eospowerup.io/eospowerupio.jpg",
    };
});
const handler = (0, functions_1.builder)((event) => __awaiter(void 0, void 0, void 0, function* () {
    const { path, queryStringParameters, headers } = event;
    const queryParamsString = queryStringParameters.toString();
    const dynamicId = (path === null || path === void 0 ? void 0 : path.split("/").pop()) || "";
    const index = (queryStringParameters === null || queryStringParameters === void 0 ? void 0 : queryStringParameters.index) || "1";
    const pageData = yield generateMetadata(dynamicId, index);
    const userAgent = headers["user-agent"] || "";
    const isBot = /bot|crawl|spider|slurp|facebookexternalhit|linkedinbot|embedly|quora|pinterest|reddit|slackbot|twitterbot|whatsapp/i.test(userAgent);
    return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: `
      <!DOCTYPE html>
      <html>
      <head>
      <!-- Primary Meta Tags -->
      <title>Page for StxXwHQySwGBzFrsGFJKIQ - Index 1</title>
      <meta name="title" content="Page for StxXwHQySwGBzFrsGFJKIQ - Index 1" />
      <meta name="description" content="This is a description for StxXwHQySwGBzFrsGFJKIQ at index 1." />

      <!-- Open Graph / Facebook -->
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://alpha.fiddl.art/r/StxXwHQySwGBzFrsGFJKIQ?index=0&referredBy=JD" />
      <meta property="og:title" content="Page for StxXwHQySwGBzFrsGFJKIQ - Index 1" />
      <meta property="og:description" content="This is a description for StxXwHQySwGBzFrsGFJKIQ at index 1." />
      <meta property="og:image" content="https://metatags.io/images/meta-tags.png" />

      <!-- Twitter -->
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content="https://alpha.fiddl.art/r/StxXwHQySwGBzFrsGFJKIQ?index=0&referredBy=JD" />
      <meta property="twitter:title" content="Page for StxXwHQySwGBzFrsGFJKIQ - Index 1" />
      <meta property="twitter:description" content="This is a description for StxXwHQySwGBzFrsGFJKIQ at index 1." />
      <meta property="twitter:image" content="https://metatags.io/images/meta-tags.png" />

      <!-- Meta Tags Generated with https://metatags.io -->
        ${isBot
            ? ""
            : `
          <script>
            window.location.replace("https://alpha.fiddl.art${path}?index=${index}");
          </script>
        `}
      </head>
      <body>
        <h1>${pageData.title}</h1>
        <p>${pageData.description}</p>
        <img src="${pageData.image}" alt="${pageData.title}" />
      </body>
      </html>
    `,
    };
}));
exports.handler = handler;
