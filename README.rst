------------------------
Twitter Video Downloader
------------------------

Twitter Video Downloader is a web extension for Google Chrome and derivatives (e.g., Chromium or Brave) that lets you download videos from Twitter, even videos from private accounts (but you have to be signed in and follow that user). You navigate to a Twitter post with the video you want and then click the icon in the toolbar to view a popup showing links to download the video.

Twitter Video Downloader is free and open open source software, Apache-2.0 licensed. Twitter Video Downloader respects your privacy; it does not depend on a third-party server, besides those of Twitter of course. No logs are stored or sent anywhere.

Why Twitter Video Downloader?
-----------------------------

- Lets you download videos from private/protected accounts on Twitter. AFAIK, this extension is the only known tool to accomplish this.
- Also lets you download public videos.
- Free and open source software.
- No third-party servers or logging.

Alternatives
~~~~~~~~~~~~

- `youtube-dl <https://github.com/ytdl-org/youtube-dl>`_: command line application; less convenient and cannot download from private profiles
- a bunch of buggy Chrome extensions not worth mentioning

Install
-------

Chrome Web Store
~~~~~~~~~~~~~~~~

TODO

Build from source
~~~~~~~~~~~~~~~~~

.. code:: bash

  $ git clone https://github.com/proprietary/twitter-video-downloader
  $ cd twitter-video-downloader/chrome-extension/twitter-video-downloader
  $ npm install
  $ npm build

Then, in Chrome:

1. Go to ``chrome://extensions``.
2. Toggle developer mode.
3. ``Load unpacked`` button at the top left of the window.
4. Open directory at ``twitter-video-downloader/chrome-extension/twitter-video-downloader/dist``.

TODOs
-----

- [ ] Port to standard Web Extensions so that it can work on Mozilla Firefox
- [ ] Add testing w/ Jest, Enzyme, etc.

Disclaimer
----------

``Twitter Video Downloader`` is not affiliated with Twitter.

Get in touch
------------

If you are a representative of Twitter and want me to take this down, or for any concerns, please direct message me `@zelcon <https://twitter.com/zelcon>`_ on Twitter. This is not a commercial project.

If you are a user and want to report issues, you can also reach me `@zelcon <https://twitter.com/zelcon>`_.

License
-------

Apache-2.0
