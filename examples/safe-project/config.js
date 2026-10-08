// Example of a safe file: no credentials in sight.
const API_BASE_URL = "https://api.example.com/v1";
const MAX_RETRIES = 3;
const requestIds = [
  "d3b07384-d9a0-4b6f-9c1a-2f4e5a6b7c8d",
  "5f8a2b1c-9e4d-4c3a-b7f6-1a2b3c4d5e6f",
];
module.exports = { API_BASE_URL, MAX_RETRIES, requestIds };
