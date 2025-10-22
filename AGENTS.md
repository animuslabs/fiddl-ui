# Agent Notes

- Always configure Quasar dialogs to render fullscreen on extra-small screens (e.g., bind `:maximized="$q.screen.lt.md"`).

# API Calls
- Always use the orval client first for making API calls. Don't use custom axios/fetch calls unless absolutely necessary.
- use `yarn orval` to regenerate the API client.

# Types
- Always prefer using types provided by libraries or generated types from orval over creating custom types.
- Never use "Any" "Unknown" or made up types in the codebase unless absolutely necessary.
