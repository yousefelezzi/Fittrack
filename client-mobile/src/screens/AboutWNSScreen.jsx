import React from 'react';
import { ScrollView, View, Linking } from 'react-native';
import { Text } from '../components/AppText';
import { Card, colors, makeStyles } from '../components';

const L = ({ url, children }) => <Text style={styles.link} onPress={() => Linking.openURL(url)}>{children}</Text>;
const B = ({ children }) => <Text style={styles.bold}>{children}</Text>;
const Section = ({ title, children }) => (
  <Card><Text style={styles.h2}>{title}</Text>{children}</Card>
);
const P = ({ children }) => <Text style={styles.p}>{children}</Text>;
const Item = ({ n, children }) => (
  <View style={styles.item}><Text style={styles.p}>{n ?? '•'}</Text><Text style={[styles.p, { flex: 1 }]}>{children}</Text></View>
);

/** How the Weekly Net Stimulus calculator works (same text as the web page). */
export default function AboutWNSScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <P>Read about the calculator, how it works, and how to use it correctly for your training programs.</P>
      <View style={{ height: 12 }} />

      <Section title="What is the Weekly Net Stimulus?">
        <P>The Weekly Net Stimulus (WNS), developed by Chris Beardsley, allows us to compare the hypertrophy caused by training programs that use different volumes or frequency.</P>
        <P>It equals the Weekly Hypertrophy Stimulus (stimulus per workout × workout frequency) minus the Weekly Atrophy Effect (atrophy days × daily atrophy rate).</P>
        <P>Unlike simple volume calculations, WNS accounts for both the stimulus from training and the atrophy that occurs between sessions and also considers the diminishing returns of volume per session.</P>
      </Section>

      <Section title="How It Works">
        <P>The Weekly Net Stimulus model relies on the following data:</P>
        <Item><B>Volume-Stimulus Relationship:</B> The relationship of the hypertrophy stimulus produced by the workout volume. It is used to determine the value of the workout stimulus relative to the hypertrophy produced by a single set (in arbitrary units).</Item>
        <Item><B>Stimulus Duration:</B> How long the growth stimulus from a training session lasts before atrophy begins. It is used to determine the number of atrophy days (days spent losing muscle) across the week.</Item>
        <Item><B>Maintenance Volume:</B> The baseline weekly volume (performed once a week) needed to prevent muscle loss. It is used (along with stimulus duration) to determine the atrophy rate (rate of muscle loss per day).</Item>
      </Section>

      <Section title="How to Use This Calculator">
        <Item n="1."><B>Select Your Dataset:</B> Choose between Schoenfeld or Pelland meta-analyses for the volume-stimulus relationship. The "Average" option picks the average between both models. The Schoenfeld meta-analysis reports that 6 sets produce 2x the stimulus of 1 set, while the Pelland meta-analysis reports that 6 sets produce 4x the stimulus of 1 set. Nonetheless, both show diminishing returns.</Item>
        <Item n="2."><B>Set Maintenance Volume:</B> Enter your estimated maintenance volume. For most people, it will be 3-4 sets once per week. However, users are free to choose between 1 and 5 sets.</Item>
        <Item n="3."><B>Set Stimulus Duration:</B> Enter duration of the growth stimulus. According to research, the growth stimulus likely lasts 36-48 hours. Nonetheless, it is still left for the user to freely pick what they believe.</Item>
        <Item n="4."><B>Enter Volume:</B> Input your training frequency and sets per workout. Note that these values are per individual muscle.</Item>
        <Item n="5."><B>Compare Programs:</B> Use "Compare programs" to see the results of different training programs (frequency/volume) one above the other.</Item>
      </Section>

      <Section title="Tips for Inputs">
        <Item n="1."><B>Varying Session Volume:</B> If different sessions differ by volume, it is a good idea to input decimal values (mainly, the average across the sessions). For example, for a program on 2x frequency which consists of 3 sets on one day and 4 sets on another day, entering 3.5 sets per workout will give the desired result.</Item>
        <Item n="2."><B>Frequency Unit:</B> If workouts are evenly spaced (Full Body every other day / Upper Lower Rest), use "every x days / every x hours" frequency unit. However, you can also input decimal frequency values (3.5x per week, 2.33x per week, etc.) Note that values like "2x a week" are different from "every 3.5 days", since the former assumes regular workout schedules while the latter assumes evenly spaced workouts.</Item>
        <Item n="3."><B>Reps in Reserve:</B> Enter how many reps you do per set and your reps in reserve (how many more reps you could have done before failure). Sets stopped short of failure count slightly less than a full set, and the further from failure, the less they count, so just enter your actual sets and the calculator accounts for it. Leave both blank if you train to failure.</Item>
      </Section>

      <Section title="Understanding the Results">
        <P>The calculator outputs the net hypertrophy effect of your training program (Weekly Net Stimulus) in arbitrary units. Higher values indicate greater net growth, and color indicators ranging from green to red are used to indicate how good or bad the result is. It's important to note:</P>
        <Item>Arbitrary units are not a unit of measurement, rather relative units used for comparison. 1st set in a workout = 1 arbitrary unit.</Item>
        <Item>Individual recovery capacity varies.</Item>
        <Item>Life stress and nutrition may affect atrophy rates and hypertrophy stimulus.</Item>
        <Item>This is just a model. Real world results may vary.</Item>
      </Section>

      <Section title="Research References">
        <Item><L url="https://doi.org/10.1080/02640414.2016.1210197">Schoenfeld et al. (2017)</L> Dose-response relationship between weekly resistance training volume and increases in muscle mass</Item>
        <Item><L url="https://doi.org/10.51224/SRXIV.460">Pelland et al. (2024)</L> Meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gain</Item>
        <Item><L url="https://journals.lww.com/acsm-msse/fulltext/2011/07000/exercise_dosing_to_retain_resistance_training.7.aspx">Bickel et al. (2011)</L> Exercise dosing to retain resistance training adaptations in young and older adults</Item>
        <Item><L url="https://doi.org/10.3390/sports12070198">Mpampoulis et al. (2024)</L> Effect of different reduced training frequencies after 12 weeks of concurrent resistance and aerobic training on muscle strength and morphology</Item>
      </Section>

      <Section title="Credits">
        <P>This calculator was created by <L url="https://instagram.com/youssef.elezzi">Youssef El Ezzi</L> based on Chris Beardsley's <L url="https://www.patreon.com/posts/weekly-net-102750269">Weekly Net Stimulus model</L>.</P>
        <P>For more detailed information about hypertrophy training and muscle physiology, consider supporting Chris Beardsley on <L url="https://www.patreon.com/SandCResearch">Patreon</L>.</P>
      </Section>

      <Section title="Disclaimer">
        <P>This calculator is based on the available data which is limited and always subject to change. Always try out different programs yourself to choose what's best, and more importantly, most enjoyable for you.</P>
      </Section>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  h2:   { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  p:    { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  bold: { fontWeight: '700', color: colors.textPrimary },
  link: { color: colors.brand, textDecorationLine: 'underline' },
  item: { flexDirection: 'row', gap: 8 },
}));
