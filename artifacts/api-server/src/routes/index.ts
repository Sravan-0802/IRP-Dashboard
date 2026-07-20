import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentRouter from "./student";
import journeyRouter from "./journey";
import authRouter from "./auth";
import syncRouter from "./sync";
import academyRouter from "./academy";
import analyticsRouter from "./analytics";
import adminRouter from "./admin";
import supportRouter from "./support";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentRouter);
router.use(journeyRouter);
router.use(authRouter);
router.use(syncRouter);
router.use(academyRouter);
router.use(analyticsRouter);
router.use(adminRouter);
router.use(supportRouter);

export default router;
