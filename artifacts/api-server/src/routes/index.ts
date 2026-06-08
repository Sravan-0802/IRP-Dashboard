import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentRouter from "./student";
import authRouter from "./auth";
import syncRouter from "./sync";
import academyRouter from "./academy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentRouter);
router.use(authRouter);
router.use(syncRouter);
router.use(academyRouter);

export default router;
