import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import productsRouter from "./products.js";
import ordersRouter from "./orders.js";
import settingsRouter from "./settings.js";
import uploadRouter from "./upload.js";
import webhookRouter from "./webhook.js";
import broadcastRouter from "./broadcast.js";
import categoriesRouter from "./categories.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(settingsRouter);
router.use(uploadRouter);
router.use(webhookRouter);
router.use(broadcastRouter);

export default router;
