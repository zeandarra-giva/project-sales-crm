#!/bin/bash
find steps -name "*.ts" -type f -exec perl -pi -e "s/import type \\{ StepConfig, Handlers \\} from 'motia'/import { type StepConfig, type Handlers, logger } from 'motia'/g" {} +
find steps -name "*.ts" -type f -exec perl -pi -e "s/import \\{ type Handlers, type StepConfig \\} from 'motia'/import { type StepConfig, type Handlers, logger } from 'motia'/g" {} +
find steps -name "*.ts" -type f -exec perl -pi -e "s/async \\(req, \\{ logger \\}\\)/async (req, ctx)/g" {} +
find steps -name "*.ts" -type f -exec perl -pi -e "s/authenticate\\(req\\)/authenticate(req.request)/g" {} +
find steps -name "*.ts" -type f -exec perl -pi -e "s/req\.body/req.request.body/g" {} +
find steps -name "*.ts" -type f -exec perl -pi -e "s/req\.pathParams/req.request.pathParams/g" {} +
