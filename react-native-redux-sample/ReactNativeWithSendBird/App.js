import React, { Component } from "react";
import {
  Platform,
  AppState,
  AsyncStorage,
  PushNotificationIOS
} from "react-native";
import { StackNavigator } from "react-navigation";
import { Provider } from "react-redux";
import FCM, {
  FCMEvent,
  NotificationType,
  NotificationActionType,
  RemoteNotificationResult,
  WillPresentNotificationResult
} from "react-native-fcm";
import JPushModule from 'jpush-react-native';
import SendBird from 'sendbird';

import {
  sbRegisterPushToken
} from './src/sendbirdActions';

import store from "./src/store";

import Start from "./src/screens/Start";
import Login from "./src/screens/Login";
import Menu from "./src/screens/Menu";
import Profile from "./src/screens/Profile";
import OpenChannel from "./src/screens/OpenChannel";
import OpenChannelCreate from "./src/screens/OpenChannelCreate";
import Chat from "./src/screens/Chat";
import Member from "./src/screens/Member";
import BlockUser from "./src/screens/BlockUser";
import GroupChannel from "./src/screens/GroupChannel";
import GroupChannelInvite from "./src/screens/GroupChannelInvite";

const receiveCustomMsgEvent = 'receivePushMsg'
const receiveNotificationEvent = 'receiveNotification'
const openNotificationEvent = 'openNotification'
const getRegistrationIdEvent = 'getRegistrationId'

const MainNavigator = StackNavigator(
  {
    Start: { screen: Start },
    Login: { screen: Login },
    Menu: { screen: Menu },
    Profile: { screen: Profile },
    OpenChannel: { screen: OpenChannel },
    OpenChannelCreate: { screen: OpenChannelCreate },
    Chat: { screen: Chat },
    Member: { screen: Member },
    BlockUser: { screen: BlockUser },
    GroupChannel: { screen: GroupChannel },
    GroupChannelInvite: { screen: GroupChannelInvite }
  },
  {
    initialRouteName: 'Start',
    navigationOptions: ({ navigation }) => ({
      headerTitleStyle: { fontWeight: "500" }
    })
  }
);
let sb = null;

function showLocalNotificationWithAction(notif) {
  try {
    const data = JSON.parse(notif.sendbird);
    FCM.presentLocalNotification({
      title: data.sender ? data.sender.name : 'SendBird',
      body: data.message,
      priority: "high",
      show_in_foreground: true,
      click_action: "com.sendbird.sample.reactnative" // for ios
    });
  } catch (e) {
  }
}

// these callback will be triggered even when app is killed
FCM.on(FCMEvent.Notification, notif => {
  console.log('background notif', notif);
  try {
    const sendbirdNotification = (typeof notif.sendbird === 'string') ? JSON.parse(notif.sendbird) : notif.sendbird;
    if (sendbirdNotification) {
      AsyncStorage.setItem('payload',
        JSON.stringify({
          "channelType": sendbirdNotification.channel_type,
          "channel": sendbirdNotification.channel
        }),
        () => { });
      showLocalNotificationWithAction(notif);
    }
  } catch (e) {
  }
});

export default class App extends Component {
  constructor(props) {
    super(props);
  }

  /**
   * Init the JPush Notification
   */
  _initJPush = () => {
    JPushModule.initPush();

    JPushModule.getInfo(map => {
      // this.setState({
      //   appkey: map.myAppKey,
      //   imei: map.myImei,
      //   package: map.myPackageName,
      //   deviceId: map.myDeviceId,
      //   version: map.myVersion
      // })
    });

    JPushModule.notifyJSDidLoad(resultCode => {
      if (resultCode === 0) {
      }
    });

    JPushModule.addReceiveCustomMsgListener(map => {
      // this.setState({
      //   pushMsg: map.content
      // })
      console.log('extras: ' + map.extras)
    })

    JPushModule.addReceiveNotificationListener(map => {
      console.log('alertContent: ' + map.alertContent)
      console.log('extras: ' + map.extras)
      // var extra = JSON.parse(map.extras);
      // console.log(extra.key + ": " + extra.value);
    })

    JPushModule.addReceiveOpenNotificationListener(map => {
      console.log('Opening notification!')
      console.log('map.extra: ' + map.extras)
      // this.jumpSecondActivity()
      // JPushModule.jumpToPushActivity("SecondActivity");
    })

    JPushModule.addGetRegistrationIdListener(registrationId => {
      console.log('Device register succeed, registrationId ' + registrationId)
    })

    JPushModule.setTags(['lontong'], map => {
      if (map.errorCode === 0) {
        console.log('Tag operate succeed, tags: ' + map.tags)
      } else {
        console.log('error code: ' + map.errorCode)
      }
    })

    const notification = {
      buildId: 1,
      id: 5,
      title: 'jpush',
      content: 'This is a test!!!!',
      extra: {
        key1: 'value1',
        key2: 'value2'
      },
      fireTime: 2000
    }
    JPushModule.sendLocalNotification(notification)
  }

  _cleanJPush = () => {
    JPushModule.removeReceiveCustomMsgListener(receiveCustomMsgEvent);
    JPushModule.removeReceiveNotificationListener(receiveNotificationEvent);
    JPushModule.removeReceiveOpenNotificationListener(openNotificationEvent);
    JPushModule.removeGetRegistrationIdListener(getRegistrationIdEvent);
    console.log('Will clear all notifications');
    JPushModule.clearAllNotifications();
  }

  _initFCM = () => {
    FCM.requestPermissions();
    FCM.on(FCMEvent.Notification, notif => {
      console.log('foreground notif', notif);
      if (Platform.OS === "ios") {
        switch (notif._notificationType) {
          case NotificationType.Remote:
            notif.finish(RemoteNotificationResult.NewData);
            break;

          case NotificationType.NotificationResponse:
            notif.finish();
            break;

          case NotificationType.WillPresent:
            notif.finish(WillPresentNotificationResult.All);
            break;
        }
        try {
          const sendbirdNotification = (typeof notif.sendbird === 'string') ? JSON.parse(notif.sendbird) : notif.sendbird;
          if (sendbirdNotification) {
            AsyncStorage.setItem('payload',
              JSON.stringify({
                "channelType": sendbirdNotification.channel_type,
                "channel": sendbirdNotification.channel
              }),
              () => { });
            showLocalNotificationWithAction(notif);
          }
        } catch (e) {
        }
      }
    });

    FCM.on(FCMEvent.RefreshToken, token => {
      AsyncStorage.setItem('pushToken', token);
      sb = SendBird.getInstance();
      AsyncStorage.getItem('user', (err, user) => {
        if (user) {
          this._registerPushToken(token);
        }
      });
    });

    if(Platform.OS === 'ios') {
      PushNotificationIOS.setApplicationIconBadgeNumber(0);
    }
  }

  componentDidMount() {
    console.disableYellowBox = true;

    setTimeout(this._initJPush, 200);

    console.log('app is launched');
    AppState.addEventListener("change", this._handleAppStateChange);
  }

  componentWillUnmount() {
    this._cleanJPush();
    console.log('app is killed');
    AppState.removeEventListener("change", this._handleAppStateChange);
  }

  render() {
    return (
      <Provider store={store}>
        <MainNavigator />
      </Provider>
    );
  }

  _registerPushToken = (token) => {
    sbRegisterPushToken(token)
      .then(res => { })
      .catch(err => { });
  }

  _handleAppStateChange = (nextAppState) => {
    const sb = SendBird.getInstance();
    if (sb) {
      if (nextAppState === 'active') {
        if(Platform.OS === 'ios') {
          PushNotificationIOS.setApplicationIconBadgeNumber(0);
        }
        console.log('app is into foreground');
        sb.setForegroundState();
      } else if (nextAppState === 'background') {
        console.log('app is into background');
        sb.setBackgroundState();
      }
    }
  }
}