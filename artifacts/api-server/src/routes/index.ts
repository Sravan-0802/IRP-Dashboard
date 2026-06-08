import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentRouter from "./student";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentRouter);
router.use(authRouter);

export default router;
