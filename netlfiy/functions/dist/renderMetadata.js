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
const generateMetadata = (dynamicId, index) => {
    return {
        title: `Page for ${dynamicId} - Index ${index}`,
        description: `This is a description for ${dynamicId} at index ${index}.`,
        image: "https://alpha.fiddl.art/.netlify/images?url=https://api.fiddl.art/images/27ec020b-8b85-46ef-ae20-c8f72eff646b-lg.webp",
    };
};
const handler = (0, functions_1.builder)((event) => __awaiter(void 0, void 0, void 0, function* () {
    const { path, queryStringParameters } = event;
    const dynamicId = (path === null || path === void 0 ? void 0 : path.split("/").pop()) || "";
    const index = (queryStringParameters === null || queryStringParameters === void 0 ? void 0 : queryStringParameters.index) || "1";
    const pageData = generateMetadata(dynamicId, index);
    return {
        statusCode: 200,
        headers: { "Content-Type": "text/html" },
        body: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta property="og:title" content="${pageData.title}" />
        <meta property="og:description" content="${pageData.description}" />
        <meta property="og:image" content="${pageData.image}" />
        <title>${pageData.title}</title>
        <script>
          if (typeof window !== 'undefined') {
            window.location.href = "https://alpha.fiddl.art${path}?index=${index}";
          }
        </script>
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
