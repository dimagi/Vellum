import {TextField, PhoneNumber, Secret} from "./text";
import {Int, Long, Double} from "./numeric";
import {AudioField, ImageField, Video, Signature, DocumentField} from "./media";
import {DateField, DateTime, Time} from "./date";
import {Choice, MSelect, Select} from "./select";
import {Group, FieldList, Repeat} from "./group";
import {DataBindOnly, ReadOnly, Geopoint, Barcode, Trigger} from "./misc";

var baseMugTypes = {
    normal: {
        "Audio": AudioField,
        "Barcode": Barcode,
        "DataBindOnly": DataBindOnly,
        "Date": DateField,
        "DateTime": DateTime,
        "Document": DocumentField,
        "Double": Double,
        "FieldList": FieldList,
        "Geopoint": Geopoint,
        "Group": Group,
        "Image": ImageField,
        "Int": Int,
        "Long": Long,
        "MSelect": MSelect,
        "PhoneNumber": PhoneNumber,
        "ReadOnly": ReadOnly,
        "Repeat": Repeat,
        "Secret": Secret,
        "Select": Select,
        "Signature": Signature,
        "Text": TextField,
        "Time": Time,
        "Trigger": Trigger,
        "Video": Video
    },
    auxiliary: {
        "Choice": Choice
    }
};

export {baseMugTypes};
