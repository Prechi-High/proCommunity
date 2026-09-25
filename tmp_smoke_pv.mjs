const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZHB0Y3V3cG5ldXl6amF2amFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjQzNjYsImV4cCI6MjEwNTA0MDM2Nn0.jbIzvkqQ7qnYhH45uvIwDI97-tjdHsPY4S-0yv9XBXg";
const JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC9P8A5Nv/AL6T/wDso/8AooA//Z";
const URL = "https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/product-vision";
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 35000);
const t0 = Date.now();
fetch(URL, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${ANON}`,
    "Content-Type": "application/json",
    "apikey": ANON,
  },
  body: JSON.stringify({
    imageBase64: JPEG_B64,
    mimeType: "image/jpeg",
    fileName: "red_1x1.jpg",
  }),
  signal: controller.signal,
}).then(async (r) => {
  const text = await r.text();
  clearTimeout(t);
  console.log("HTTP:", r.status, r.statusText);
  console.log("TIME_MS:", Date.now() - t0);
  console.log("BODY_BEGIN");
  console.log(text);
  console.log("BODY_END");
  process.exit(r.ok ? 0 : 1);
}).catch((err) => {
  clearTimeout(t);
  console.log("FETCH_ERR:", err.name, err.message);
  console.log("TIME_MS:", Date.now() - t0);
  process.exit(2);
});
