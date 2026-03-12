import { Router, type IRouter } from "express";
import healthRouter from "./health";
import textRouter from "./text";
import explainRouter from "./explain";

const router: IRouter = Router();

router.use(healthRouter);
router.use(textRouter);
router.use(explainRouter);

export default router;
