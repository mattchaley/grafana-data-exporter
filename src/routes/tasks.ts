import { Target } from '../target'

import * as express from 'express'


async function addTask(req, res) {
  let body = req.body;
  let from = parseInt(body.from);
  let to = parseInt(body.to);
  let panelUrl = body.panelUrl;
  let targets = [body.target];
  let datasource = body.datasourceRequest;
  let user = body.user;

  if(isNaN(from) || isNaN(to)) {
    res.status(500).send('Range error: please fill both "from" and "to" fields');
  } else if(from >= to) {
    res.status(500).send('Range error: "from" should be less than "to"');
  } else {
    res.status(200).send('Task added');
    let target = new Target(panelUrl, user, datasource, targets, from, to);
    target.export();
  }
}

export const router = express.Router();

router.post('/', addTask);
