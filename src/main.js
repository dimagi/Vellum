// Import polyfill first to ensure gettext is available when other modules load
import 'vellum/gettext-polyfill';
import 'vellum/core';
import 'vellum/ignoreButRetain';
import 'vellum/intentManager';
import 'vellum/itemset';
import 'vellum/javaRosa/plugin';
import 'vellum/datasources';
import 'vellum/lock';
import 'vellum/databrowser';
import 'vellum/commtrack';
import 'vellum/modeliteration';
import 'vellum/saveToCase';
import 'vellum/uploader';
import 'vellum/window';
import 'vellum/copy-paste';
import 'vellum/commander';
import 'vellum/commcareConnect';
import 'vellum/caseManagement';
import 'vellum/jqueryCleanup';

// These imports add $.vellum plugins as side-effects