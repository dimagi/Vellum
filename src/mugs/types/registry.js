import {Barcode, DateField, DateTime, Double, Geopoint, Int, Long, PhoneNumber, Secret, TextField, Time} from "./primitive";
import {AudioField, DocumentField, ImageField, Signature, Video} from "./media";
import {Choice, MSelect, Select} from "./select";
import {FieldList, Group, Repeat} from "./group";
import {DataBindOnly, ReadOnly, Trigger} from "./special";

const baseMugTypes = {
    normal: {
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
        "Video": Video,
        "Audio": AudioField,
    },
    auxiliary: {
        "Choice": Choice
    }
};

export default baseMugTypes;
