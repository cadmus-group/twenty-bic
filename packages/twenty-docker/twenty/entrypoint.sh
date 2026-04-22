#!/bin/sh
set -e

setup_and_migrate_db() {
    if [ "${DISABLE_DB_MIGRATIONS}" = "true" ]; then
        echo "Database setup and migrations are disabled, skipping..."
        return
    fi

    echo "Running database setup and migrations..."

    # Run setup and migration scripts
    has_schema=$(psql -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'core')" ${PG_DATABASE_URL})
    if [ "$has_schema" = "f" ]; then
        echo "Database appears to be empty, running migrations."
        NODE_OPTIONS="--max-old-space-size=1500" node ./dist/scripts/setup-db.js
        yarn database:migrate:prod
    fi

    yarn command:prod cache:flush
    yarn command:prod upgrade
    yarn command:prod cache:flush

    echo "Successfully migrated DB!"
}

register_background_jobs() {
    if [ "${DISABLE_CRON_JOBS_REGISTRATION}" = "true" ]; then
        echo "Cron job registration is disabled, skipping..."
        return
    fi

    echo "Registering background sync jobs..."
    if yarn command:prod cron:register:all; then
        echo "Successfully registered all background sync jobs!"
    else
        echo "Warning: Failed to register background jobs, but continuing startup..."
    fi
}

# Run dev-seed once when SEED_ON_BOOT=true. Set this env var, redeploy, wait for
# seed to finish (check logs), then unset the env var to avoid re-seeding on
# every container restart. Using --max-old-space-size to stay within Railway's
# per-container memory and prevent OOM when the API would also boot.
seed_workspace_if_requested() {
    if [ "${SEED_ON_BOOT}" = "true" ]; then
        echo "SEED_ON_BOOT=true — running workspace:seed:dev --light..."
        if NODE_OPTIONS="--max-old-space-size=1200" \
            node dist/command/command workspace:seed:dev --light; then
            echo "Seed completed. REMEMBER to unset SEED_ON_BOOT before next deploy."
        else
            echo "Warning: seed command failed (see logs above). Continuing startup..."
        fi
    fi
}

setup_and_migrate_db
register_background_jobs
seed_workspace_if_requested

# Continue with the original Docker command
exec "$@"
