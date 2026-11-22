import { Router } from 'express';
import {
    calculate,
    confirmarOCR,
    cotizar,
    getConstants,
    listarInventario,
    parsearOCR
} from './calculator.controller.js';

const router = Router();

router.get('/energy/constants', getConstants);
router.post('/energy/calculate', calculate);
// Alias del Manual Maestro / app Kotlin (Prompt 4.1)
router.post('/solar/calculate', calculate);

router.get('/inventory', listarInventario);
router.post('/solar/ocr-parse', parsearOCR);
router.post('/solar/ocr-confirm', confirmarOCR);
router.post('/solar/quote', cotizar);

export default router;
