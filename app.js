import express from 'express';
import data from './routes/dataRouter.js';

const app = express();
app.use(express.json());  
app.use("/api/data",data);

export default app;