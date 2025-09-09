{ pkgs }:
{
  deps = [
    pkgs.nodejs-18_x
    pkgs.chromium
    pkgs.python3
  ];

  env = {
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";
    PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
  };
}