import baseSpecs from "./mugs/mugBaseSpecs";
import defaultOptions from "./mugs/mugDefaultOptions";
import MugCore from "./mugs/mugCore";
import MugMessages from "./mugs/mugMessages";
import {deserializeXPath, serializeXPath, updateInstances} from "./mugs/mugXPath";
import baseMugTypes from "./mugs/types/registry";
import MugTypesManager from "./mugs/typesManager";

MugTypesManager.Mug = MugCore;

export default {
    defaultOptions: defaultOptions,
    baseMugTypes: baseMugTypes,
    MugTypesManager: MugTypesManager,
    MugMessages: MugMessages,
    WARNING: MugCore.WARNING,
    ERROR: MugCore.ERROR,
    baseSpecs: baseSpecs,
    deserializeXPath: deserializeXPath,
    serializeXPath: serializeXPath,
    updateInstances: updateInstances,
};
