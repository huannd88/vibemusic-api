-- CreateTable
CREATE TABLE "user_taste_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "taste_vector" TEXT NOT NULL,
    "top_genres" TEXT,
    "top_moods" TEXT,
    "top_artists" TEXT,
    "listen_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_taste_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "track_ids" TEXT NOT NULL,
    "metadata" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "source" TEXT,
    "input" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "time_of_day" TEXT,
    "activity" TEXT,
    "weather" TEXT,
    "location" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "events" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,

    CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_taste_profiles_user_id_key" ON "user_taste_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
