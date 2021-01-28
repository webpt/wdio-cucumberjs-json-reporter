"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fsExtra = require("fs-extra");

var _path = require("path");

var _logger = _interopRequireDefault(require("@wdio/logger"));

var _reporter = _interopRequireDefault(require("@wdio/reporter"));

var _utils = _interopRequireDefault(require("./utils"));

var _metadata = _interopRequireDefault(require("./metadata"));

var _constants = require("./constants");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const log = (0, _logger.default)('wdio-multiple-cucumber-html-reporter');

class CucumberJsJsonReporter extends _reporter.default {
  constructor(options) {
    super(options);

    if (!options.jsonFolder) {
      options.jsonFolder = _constants.DEFAULT_JSON_FOLDER;
      log.info(`The 'jsonFolder' was not set, it has been set to the default '${_constants.DEFAULT_JSON_FOLDER}'`);
    }

    if (!options.language) {
      options.language = _constants.DEFAULT_LANGUAGE;
      log.info(`The 'language' was not set, it has been set to the default '${_constants.DEFAULT_LANGUAGE}'`);
    }

    this.options = options;
    this.instanceMetadata = null;
    this.report = {};
    this.registerListeners();
  }
  /**
   * Add a customer listener for the attachments
   */


  registerListeners() {
    process.on('wdioCucumberJsReporter:attachment', this.cucumberJsAttachment.bind(this));
  }
  /**
   * The order of running of the `on*` is the following:
   * - onRunnerStart
   * - onSuiteStart (feature)
   * - onSuiteStart (scenario)
   * - onHookStart
   * - onHookEnd
   * - onTestStart
   * - onBeforeCommand
   * - onAfterCommand
   * - onTestPass
   * - onHookStart
   * - onHookEnd
   * - onSuiteEnd (scenario is done)
   * - onSuiteEnd (feature is done)
   * - onRunnerEnd
   */

  /**
   * This hook is used to retrieve the browser data, but this is done only once
   *
   * @param {object} runnerData
   */


  onRunnerStart(runnerData) {
    if (!this.instanceMetadata) {
      this.instanceMetadata = _metadata.default.determineMetadata(runnerData);
    }
  }
  /**
   * This hook is called twice:
   * 1. create the feature
   * 2. add the scenario to the feature
   *
   * @param {object} payload
   */


  onSuiteStart(payload) {
    if (!this.report.feature) {
      return this.report.feature = this.getFeatureDataObject(payload);
    }
    /* istanbul ignore else */


    if (!this.report.feature.metadata) {
      this.report.feature = _objectSpread({}, this.report.feature, {}, this.instanceMetadata);
    }

    return this.report.feature.elements.push(this.getScenarioDataObject(payload, this.report.feature.id));
  }
  /**
   * This one is for the start of the hook and determines if this is a pending `before` or `after` hook.
   * The data will be equal to a step, so a hook is added as a step.
   *
   * @param payload
   */


  onHookStart(payload) {
    // There is always a scenario, take the last one
    const currentSteps = this.getCurrentScenario().steps;
    payload.state = _constants.PENDING;
    payload.keyword = _utils.default.containsSteps(currentSteps, this.options.language) ? _constants.AFTER : _constants.BEFORE;
    return this.addStepData(payload);
  }
  /**
   * This one is for the end of the hook, it directly comes after the onHookStart
   * A hook is the same  as a 'normal' step, so use the update step
   *
   * @param payload
   */


  onHookEnd(payload) {
    payload.state = payload.error ? payload.state : _constants.PASSED;
    return this.updateStepStatus(payload);
  }
  /**
   * This one starts the step, which will be set to pending
   *
   * @param {object} payload
   */


  onTestStart(payload) {
    this.addStepData(payload);
  } // /**
  //  * This one starts a command
  //  *
  //  * @param payload
  //  */
  // onBeforeCommand(payload) {
  //     // console.log('\nconst onBeforeCommand= ', JSON.stringify(payload), '\n')
  // }
  // /**
  //  * This is the result of the command
  //  *
  //  * @param payload
  //  */
  // onAfterCommand(payload) {
  //     // console.log('\nconst onAfterCommand= ', JSON.stringify(payload), '\n')
  // }
  // onScreenshot(payload) {
  //     // console.log('\nconst onScreenshot= ', JSON.stringify(payload), '\n')
  // }

  /**
   * The passed step
   *
   * @param payload
   */


  onTestPass(payload) {
    this.updateStepStatus(payload);
  }
  /**
   * The failed step including the logs
   *
   * @param payload
   */


  onTestFail(payload) {
    this.updateStepStatus(payload);
  }
  /**
   * The skippe step
   *
   * @param payload
   */


  onTestSkip(payload) {
    this.updateStepStatus(payload);
  } // onTestEnd(payload) {
  //     console.log('\nonTestEnd');
  // }
  // /**
  //  * Executed twice:
  //  * - at the end of a scenario
  //  * - at the end of all scenario's
  //  *
  //  * @param payload
  //  */
  // onSuiteEnd(payload) {}

  /**
   * Runner is done, write the file
   */


  onRunnerEnd() {
    const jsonFolder = (0, _path.resolve)(process.cwd(), this.options.jsonFolder);
    const jsonFile = (0, _path.resolve)(jsonFolder, `${this.report.feature.id}.json`);
    const json = [this.report.feature]; // Check if there is an existing file, if so concat the data, else add the new

    const output = (0, _fsExtra.existsSync)(jsonFile) ? json.concat((0, _fsExtra.readJsonSync)(jsonFile)) : json;
    (0, _fsExtra.outputJsonSync)(jsonFile, output);
  }
  /**
   * All functions
   */

  /**
   * Get the feature data object
   *
   * @param {object} featureData
   *
   * @returns {
   *  {
   *      keyword: string,
   *      line: number,
   *      name: string,
   *      tags: string,
   *      uri: string,
   *      elements: Array,
   *      id: string,
   *  }
   * }
   */


  getFeatureDataObject(featureData) {
    const featureName = featureData.title;
    return {
      keyword: _constants.FEATURE,
      type: featureData.type,
      description: featureData.description || '',
      line: parseInt(featureData.uid.substring(featureName.length, featureData.uid.length)),
      name: featureName,
      uri: 'Can not be determined',
      tags: featureData.tags || '',
      elements: [],
      id: featureName.replace(/[\\/?%*:|"<> ]/g, '-').toLowerCase()
    };
  }
  /**
   * Get the scenario data object
   *
   * @param {object} scenarioData This is the testdata of the current scenario
   * @param {string} id scenario id
   *
   * @returns {
   *  {
   *      keyword: string,
   *      description: string,
   *      name: string,
   *      tags: string,
   *      id: string,
   *      steps: Array,
   *  }
   * }
   */


  getScenarioDataObject(scenarioData, id) {
    const scenarioName = scenarioData.title;
    return {
      keyword: _constants.SCENARIO,
      type: scenarioData.type,
      description: scenarioData.description || '',
      name: scenarioName,
      tags: scenarioData.tags || '',
      id: `${id};${scenarioName.replace(/ /g, '-').toLowerCase()}`,
      steps: []
    };
  }
  /**
   * Get the step data object
   *
   * @param {object} stepData This is the testdata of the step
   *
   * @returns {
   *  {
   *      arguments: Array,
   *      keyword: string,
   *      name: *,
   *      result: {
   *          status: string,
   *          duration: number
   *      },
   *      line: number,
   *      match: {
   *          location: string,
   *      },
   *  }
   * }
   */


  getStepDataObject(stepData) {
    const keyword = stepData.keyword || _utils.default.keywordStartsWith(stepData.title, this.options.language) || '';
    let title = "";

    try {
      title = (stepData.title.split(keyword).pop() || stepData.title || '').trim();
    } catch (e) {
      if (stepData.title) {
        title = stepData.title;
      }
    }

    const stepResult = {
      arguments: stepData.argument ? [stepData.argument] : [],
      keyword: keyword,
      name: title,
      result: _objectSpread({
        status: stepData.state || '',
        duration: (stepData._duration || 0) * 1000000
      }, _utils.default.getFailedMessage(stepData)),
      line: parseInt(stepData.uid.substring(title.length, stepData.uid.length)) || '',
      match: {
        location: 'can not be determined with webdriver.io'
      }
    };
    return stepResult;
  }
  /**
   * Get the current scenario
   *
   * @return {object}
   */


  getCurrentScenario() {
    return this.report.feature.elements[this.report.feature.elements.length - 1];
  }
  /**
   * Get the current step
   *
   * @return {object}
   */


  getCurrentStep() {
    const currentScenario = this.getCurrentScenario();
    return currentScenario.steps[currentScenario.steps.length - 1];
  }
  /**
   * Add step data to the current running scenario
   *
   * @param {object} test
   */


  addStepData(test) {
    // Always add the finished step to the end of the steps
    // of the last current scenario that is running
    return this.getCurrentScenario().steps.push(this.getStepDataObject(test));
  }
  /**
   * Add step data to the current running scenario
   *
   * @param {object} test
   */


  updateStepStatus(test) {
    // There is always a scenario, take the last one
    const currentSteps = this.getCurrentScenario().steps;
    const currentStepsLength = currentSteps.length;
    const stepData = this.getStepDataObject(test);
    currentSteps[currentStepsLength - 1] = _objectSpread({}, this.getCurrentStep(), {}, stepData);
  }
  /**
   * Attach data to the report
   *
   * @param {string|object} data
   * @param {string} type Default is `text/plain`, otherwise what people deliver as a MIME type, like `application/json`, `image/png`
   */


  static attach(data, type = _constants.TEXT_PLAIN) {
    process.emit('wdioCucumberJsReporter:attachment', {
      data,
      type
    });
  }
  /**
   * Add the attachment to the result
   *
   * @param {string|object} data
   * @param {string} type
   */


  cucumberJsAttachment({
    data,
    type
  }) {
    // The attachment can be added to the current running scenario step
    const currentStep = this.getCurrentStep();
    const embeddings = {
      data: data,
      mime_type: type
    }; // Check if there is an embedding, if not, add it, else push it

    if (!currentStep.embeddings) {
      currentStep.embeddings = [embeddings];
    } else {
      currentStep.embeddings.push(embeddings);
    }
  }

}

CucumberJsJsonReporter.reporterName = 'cucumberjs-json';
var _default = CucumberJsJsonReporter;
exports.default = _default;