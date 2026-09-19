DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "BusMedia"
		GROUP BY "busId", "mediaId"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Duplicate BusMedia relations exist; clean them before applying this migration';
	END IF;

	IF EXISTS (
		SELECT 1 FROM "BusMedia"
		WHERE "isPrimary" = true
		GROUP BY "busId"
		HAVING COUNT(*) > 1
	) OR EXISTS (
		SELECT 1 FROM "VehicleMedia"
		WHERE "isPrimary" = true
		GROUP BY "vehicleId"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Multiple primary media exist; resolve them before applying this migration';
	END IF;
END $$;

CREATE UNIQUE INDEX "BusMedia_busId_mediaId_key" ON "BusMedia"("busId", "mediaId");
CREATE INDEX "BusMedia_busId_isPrimary_idx" ON "BusMedia"("busId", "isPrimary");
CREATE INDEX "BusMedia_busId_order_idx" ON "BusMedia"("busId", "order");
CREATE UNIQUE INDEX "VehicleMedia_one_primary_per_vehicle_key"
ON "VehicleMedia"("vehicleId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX "BusMedia_one_primary_per_bus_key"
ON "BusMedia"("busId") WHERE "isPrimary" = true;