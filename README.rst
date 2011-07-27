FormDesigner 2.0
================

Installation/Usage
------------------
Using/Testing the FormDesigner is easy.  Clone the repo and serve it through a webserver.  Point your browser to index.html, or test.html (for Unit Tests), and you're off to the races.

The super easy way
~~~~~~~~~~~~~~~~~~
1. Clone the repo
2. Download Mongoose: http://code.google.com/p/mongoose/
3. Place the mongoose exe file in the root of the repo and execute
4. Open browser and go to http://localhost:8080 (for tests go to http://localhost:8080/test.html)

That's it!

Usage as a Jquery-UI like plugin
--------------------------------
1. Clone the repo
2. Place all the subfolders in the same folder as the html file you're planning to run the plugin from.
3. In your $(document).ready() call formdesigner.launch(arg), where arg is a jquery selector pointing to the div you would like to use as the container for the fd.



Contact: adewinter [at] dimagi dot C O M
