{
  description = "NixOS configuration with two or more channels";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      versions = (builtins.fromJSON (builtins.readFile ./versions.json));
      magic = { pkg, name, ver, archive, sha256, ... }: pkg.overrideDerivation (old: with nixpkgs.lib.strings; {
        name = toLower name + "-" + ver;
        version = ver;
        src = builtins.fetchurl {
          url = archive;
          inherit sha256;
        };
      });
      resolveBuilds = { versionInfo }: with versionInfo; with nixpkgs.legacyPackages.x86_64-linux.jetbrains; {
        datagrip = with DG; (magic ({
          pkg = datagrip;
          name = "datagrip";
        } // DG));
        phpstorm = with PS; (magic ({
          pkg = phpstorm;
          name = "phpstorm";
        } // PS));
        idea-community = with IIC; (magic ({
          pkg = idea-community;
          name = "idea-community";
        } // IIC));
        idea-ultimate = with IIU; (magic ({
          pkg = idea-ultimate;
          name = "idea-ultimate";
        } // IIU));
        goland = with GO; (magic ({
          pkg = goland;
          name = "goland";
        } // GO));
        clion = with CL; (magic ({
          pkg = clion.overrideDerivation (old: {
            autoPatchelfIgnoreMissingDeps = true;
            postFixup = builtins.replaceStrings [ clion.name ] [ "clion-${ver}" ] old.postFixup;
          });
          name = "clion";
        } // CL));
        rider = with RD; (magic ({
          pkg = rider;
          name = "rider";
        } // RD));
        pycharm-professional = with PCP; (magic ({
          pkg = pycharm-professional;
          name = "pycharm-professional";
        } // PCP));
        webstorm = with WS; (magic ({
          pkg = webstorm;
          name = "webstorm";
        } // WS));
      };
    in
    {
      packages.x86_64-linux = resolveBuilds {
        versionInfo = versions.eap;
      };
    };
}
