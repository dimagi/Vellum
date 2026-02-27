import baseSpecs from "./mugs/mugBaseSpecs";
import defaultOptions from "./mugs/mugDefaultOptions";
import Mug from "./mugs/mugCore";
import MugMessages from "./mugs/mugMessages";
import {deserializeXPath, serializeXPath, updateInstances} from "./mugs/mugXPath";
import baseMugTypes from "./mugs/types/registry";
import MugTypesManager from "./mugs/typesManager";

MugTypesManager.Mug = Mug;

export default {
    defaultOptions: defaultOptions,
    baseMugTypes: baseMugTypes,
    MugTypesManager: MugTypesManager,
    MugMessages: MugMessages,
    WARNING: Mug.WARNING,
    ERROR: Mug.ERROR,
    baseSpecs: baseSpecs,
    deserializeXPath: deserializeXPath,
    serializeXPath: serializeXPath,
    updateInstances: updateInstances,
};
