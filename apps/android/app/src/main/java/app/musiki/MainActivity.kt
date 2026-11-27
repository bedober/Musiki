package app.musiki
import android.os.Bundle
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.Player
class MainActivity:ComponentActivity(){
 private var player:ExoPlayer?=null
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState)
  player=ExoPlayer.Builder(this).build()
  val view=TextView(this).apply{text="MUSIKI\n\nYour sound, your world.\n\nConnect your account to sync your library.\nOffline playback is ready for locally downloaded, licensed tracks.";textSize=20f;setPadding(36,80,36,36)}
  setContentView(view)
 }
 override fun onStop(){super.onStop();player?.release();player=null}
}