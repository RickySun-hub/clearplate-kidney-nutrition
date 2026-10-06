import { handleNutritionRequest } from '../server/snapshot.js';

export default function handler(req, res) {
  return handleNutritionRequest(req, res, service => service.getFood(req.query?.fdcId));
}
