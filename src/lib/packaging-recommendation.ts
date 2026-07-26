// ==========================================
// Packaging Recommendation Engine v2.0
// ==========================================
// Ported as-supplied. Given a cargo item's dimensions/weight/temperature
// profile, this tries all 6 axis rotations against each candidate package's
// usable internal space (internal dims minus clearance on every side) and
// returns every package that fits, ranked by smallest package volume first
// (least wasted space), then by explicit priority as a tie-breaker.

export interface Cargo {
  length: number;
  width: number;
  height: number;
  weight?: number;
  temperatureProfile?: string;
}

export interface PackageModel {
  id: string;
  manufacturer: string;
  model: string;
  internalLength: number;
  internalWidth: number;
  internalHeight: number;
  clearance: number;
  maxWeight?: number;
  usableVolume?: number;
  temperatureProfile?: string;
  priority?: number;
  active: boolean;
}

export interface Rotation {
  length: number;
  width: number;
  height: number;
  name: string;
}

export interface PackageMatch {
  package: PackageModel;
  rotation: string;
  utilization: number;
}

export class PackagingRecommendationService {
  recommend(cargo: Cargo, packages: PackageModel[]): PackageMatch[] {
    const matches: PackageMatch[] = [];

    for (const pkg of packages) {
      if (!pkg.active) continue;

      if (
        cargo.temperatureProfile &&
        pkg.temperatureProfile &&
        cargo.temperatureProfile !== pkg.temperatureProfile
      )
        continue;

      if (cargo.weight && pkg.maxWeight && cargo.weight > pkg.maxWeight) continue;

      const fit = this.findRotation(cargo, pkg);
      if (!fit) continue;

      matches.push({
        package: pkg,
        rotation: fit.name,
        utilization: this.calculateUtilization(cargo, pkg),
      });
    }

    matches.sort((a, b) => {
      const volumeA = this.packageVolume(a.package);
      const volumeB = this.packageVolume(b.package);
      if (volumeA === volumeB) {
        return (a.package.priority ?? 999) - (b.package.priority ?? 999);
      }
      return volumeA - volumeB;
    });

    return matches;
  }

  private findRotation(cargo: Cargo, pkg: PackageModel): Rotation | null {
    const rotations = this.generateRotations(cargo);
    for (const r of rotations) {
      if (
        r.length <= pkg.internalLength - pkg.clearance * 2 &&
        r.width <= pkg.internalWidth - pkg.clearance * 2 &&
        r.height <= pkg.internalHeight - pkg.clearance * 2
      ) {
        return r;
      }
    }
    return null;
  }

  private generateRotations(cargo: Cargo): Rotation[] {
    return [
      { length: cargo.length, width: cargo.width, height: cargo.height, name: "XYZ" },
      { length: cargo.length, width: cargo.height, height: cargo.width, name: "XZY" },
      { length: cargo.width, width: cargo.length, height: cargo.height, name: "YXZ" },
      { length: cargo.width, width: cargo.height, height: cargo.length, name: "YZX" },
      { length: cargo.height, width: cargo.length, height: cargo.width, name: "ZXY" },
      { length: cargo.height, width: cargo.width, height: cargo.length, name: "ZYX" },
    ];
  }

  private packageVolume(pkg: PackageModel): number {
    return pkg.internalLength * pkg.internalWidth * pkg.internalHeight;
  }

  private cargoVolume(cargo: Cargo): number {
    return cargo.length * cargo.width * cargo.height;
  }

  private calculateUtilization(cargo: Cargo, pkg: PackageModel): number {
    const volume = pkg.usableVolume ?? this.packageVolume(pkg);
    return Number((this.cargoVolume(cargo) / volume).toFixed(2));
  }
}
