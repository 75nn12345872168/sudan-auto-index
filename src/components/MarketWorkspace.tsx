"use client";

import { useState } from "react";
import FairPriceCalculator from "./FairPriceCalculator";
import CarListingsSection from "./CarListingsSection";
import UploadListingModal from "./UploadListingModal";
import type { CarListing } from "@/lib/types";

interface MarketWorkspaceProps {
  initialListings: CarListing[];
  parallelRate: number;
}

export default function MarketWorkspace({
  initialListings,
  parallelRate,
}: MarketWorkspaceProps) {
  const [listings, setListings] = useState<CarListing[]>(initialListings);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleListingCreated = (newListing: CarListing) => {
    setListings((prev) => [newListing, ...prev]);
  };

  return (
    <div className="space-y-10">
      <FairPriceCalculator listings={listings} parallelRate={parallelRate} />

      <CarListingsSection
        listings={listings}
        onOpenUploadModal={() => setIsUploadOpen(true)}
      />

      <UploadListingModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        parallelRate={parallelRate}
        onListingCreated={handleListingCreated}
      />
    </div>
  );
}
