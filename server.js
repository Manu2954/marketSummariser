import app from "./app.js"
const port = 3000;

app.listen(port, ()=>{
    console.log(`server running on http://127.0.0.1:${port}`)
});