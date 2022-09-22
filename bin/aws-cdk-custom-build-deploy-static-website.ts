import { App } from 'aws-cdk-lib';
import { FrontendStack } from 'lib/stacks/frontend';

const app = new App();

new FrontendStack(app, 'FrontendStack');
