import Router from '@koa/router';
import { ILogger } from '../../logger';
import { setResponse } from '../utils';
import { NOT_FOUND, OK } from 'http-status-codes';
import { guard } from '../guards';
import { getRepository } from 'typeorm';
import { User, IUserSession } from '../../models';
import { validateGithubId } from '../validators';
import { getStudentStats } from '../profile/student-stats';
import { getPublicFeedback } from '../profile/public-feedback';
import {Permissions} from '../profile/permissions';

const saveCVIData = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const { githubId } = ctx.params;
  const userRepository = getRepository(User);
  const user = await userRepository.findOne({ where: { githubId } });
  if (user === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }
  const {
    selfIntroLink,
    startFrom,
    fullTime,
    militaryService,
    avatarLink,
    englishLevel,
    desiredPosition,
    cvName,
    cvNotes,
    cvPhone,
    cvEmail,
    cvSkype,
    cvTelegram,
    cvLinkedin,
    cvLocation,
    cvGithub,
    cvWebsite
  } = ctx.request.body;

  const result = await userRepository.save({
    ...user,
    selfIntroLink,
    startFrom,
    fullTime,
    militaryService,
    avatarLink,
    englishLevel,
    desiredPosition,
    cvName,
    cvNotes,
    cvPhone,
    cvEmail,
    cvSkype,
    cvTelegram,
    cvLinkedin,
    cvLocation,
    cvGithub,
    cvWebsite
  });
  setResponse(ctx, OK, result);
};

const getProfiles = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const users = await getRepository(User)
    .createQueryBuilder('user')
    .select([
      'user.selfIntroLink AS selfIntroLink',
      'user.militaryService AS militaryService',
      'user.startFrom AS startFrom',
      'user.fullTime AS fullTime',
      'user.avatarLink AS avatarLink',
      'user.desiredPosition AS desiredPosition',
      'user.englishLevel AS englishLevel',
      'user.educationHistory AS educationHistory',
      'user.cvName AS name',
      'user.cvNotes AS notes',
      'user.cvPhone AS phone',
      'user.cvEmail AS email',
      'user.cvSkype AS skype',
      'user.cvTelegram AS telegram',
      'user.cvLinkedin AS linkedin',
      'user.cvLocation AS location',
      'user.cvGithub AS github',
      'user.cvWebsite AS website'
    ])
    .where('"opportunitiesConsent" = true')
    .execute();
  setResponse(ctx, OK, users);
};

const getCVProfilesGeneralInfo = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const users = await getRepository(User)
    .createQueryBuilder('user')
    .select([
      'user.cvName AS cvName',
      'user.githubId as githubId',
      'user.desiredPosition AS desiredPosition',
      'user.englishLevel AS englishLevel',
      'user.fullTime AS fullTime',
      'user.cvLocation AS cvLocation',
      'user.startFrom AS startFrom'
    ])
    .where('"opportunitiesConsent" = true')
    .leftJoinAndSelect('user.githubId', 'student.githubId')
    .execute();
  setResponse(ctx, OK, users);
};

export const getCVData = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const { githubId } = ctx.state!.user as IUserSession;

  const userRepository = getRepository(User);
  const profile = await userRepository.findOne({ where: { githubId } });

  if (profile === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }

  const {
    cvName: name,
    desiredPosition,
    avatarLink,
    englishLevel,
    militaryService,
    selfIntroLink,
    fullTime,
    startFrom,
    cvPhone: phone,
    cvEmail: email,
    cvSkype: skype,
    cvTelegram: telegram,
    cvLinkedin: linkedin,
    cvLocation: location,
    cvGithub: github,
    cvWebsite: website,
    cvNotes: notes
  } = profile;

  const studentStats = await getStudentStats(githubId, {isCoreJsFeedbackVisible: false} as Permissions );
  const publicFeedback = await getPublicFeedback(githubId);

  const CVData = {
    selfIntroLink,
    startFrom,
    fullTime,
    militaryService,
    avatarLink,
    desiredPosition,
    englishLevel,
    name,
    notes,
    phone,
    email,
    skype,
    telegram,
    linkedin,
    location,
    github,
    website
  };

  setResponse(ctx, OK, CVData);

};

export const setOpportunitiesConsent = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const { githubId } = ctx.state!.user as IUserSession;

  const userRepository = getRepository(User);
  const profile = await userRepository.findOne({ where: { githubId } });
  if (profile === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }

  const { opportunitiesConsent: reqConsent } = ctx.request.body;
  const prevConsent = profile.opportunitiesConsent;

  if (reqConsent === prevConsent) {
    setResponse(ctx, OK, profile.opportunitiesConsent);
    return;
  }

  const emptyOpportunitiesInfo = {
    selfIntroLink: null,
    fullTime: false,
    startFrom: null,
    cvLink: null,
    educationHistory: [],
    employmentHistory: [],
    militaryService: null,
    avatarLink: null,
    cvName: null,
    cvNotes: null,
    cvPhone: null,
    cvEmail: null,
    cvSkype: null,
    cvTelegram: null,
    cvLinkedin: null,
    cvLocation: null,
    cvGithub: null,
    cvWebsite: null
  };

  const userWithEmptyOpportunities = {
    ...profile,
    ...emptyOpportunitiesInfo,
    opportunitiesConsent: reqConsent
  };

  const result = await userRepository.save({ ...profile, ...userWithEmptyOpportunities });
  setResponse(ctx, OK, result.opportunitiesConsent);

};

export const getOpportunitiesConsent = (_: ILogger) => async (ctx: Router.RouterContext) => {
  const { githubId } = ctx.state!.user as IUserSession;

  const profile = await getRepository(User).findOne({ where: { githubId } });
  if (profile === undefined) {
    setResponse(ctx, NOT_FOUND);
    return;
  }

  setResponse(ctx, OK, profile.opportunitiesConsent);
};

export function opportunitiesRoute(logger: ILogger) {
  const router = new Router<any, any>({ prefix: '/opportunities' });

  router.get('/', guard, getProfiles(logger));

  router.get('/:githubId', guard, getCVData(logger));
  router.post('/:githubId', guard, validateGithubId, saveCVIData(logger));


  router.get('/consent/:githubId', guard, getOpportunitiesConsent(logger));
  router.post('/consent/:githubId', guard, setOpportunitiesConsent(logger));

  return router;
}
