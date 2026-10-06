import { handleNutritionRequest } from '../server/snapshot.js';

export default function handler(req, res) {
  return handleNutritionRequest(req, res, service => service.search({
    q: req.query?.q, pageSize: req.query?.pageSize, dataTypes: req.query?.dataTypes,
  }));
}
